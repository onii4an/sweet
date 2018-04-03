class User < ApplicationRecord
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable and :omniauthable
  validates :intro, length: { maximum: 50 }
  validates :username, presence: true, uniqueness: { case_sensitive: false }
  validates_format_of :username, with: /^[a-zA-Z0-9_\.]*$/, multiline: true
  devise :database_authenticatable, :registerable,
         :recoverable, :rememberable, :trackable, :validatable, :onliner
  # scope :search_name_and_surname, -> (q, g) { where('name ILIKE ?', '%#{q}%', 'surname ILIKE ?', '%#{g}%') }
  scope :search_name, ->(q) { where('name like ?', "#{q}%") }
  scope :search_surname, ->(q) { where('surname like ?', "#{q}%") }
  # scope :search_username, -> (q) { where('username ILIKE ?', '%#{q}%') }

  attr_accessor :login
  def self.find_for_database_authentication(warden_conditions)
    conditions = warden_conditions.dup
    if login = conditions.delete(:login)
      where(conditions.to_h).where(['lower(username) = :value OR lower(email) = :value', { value: login.downcase }]).first
    elsif conditions.key?(:username) || conditions.key?(:email)
      where(conditions.to_h).first
    end
  end
end
