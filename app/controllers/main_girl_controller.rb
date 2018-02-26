class MainGirlController < ApplicationController
  before_action :check_girl

  def index; end

  private

  def check_girl
    redirect_to root_path unless current_girl
    current_girl.update('in_a_conversation'=> false, 'waiting' => false)
  end
end
