class CreateUsers < ActiveRecord::Migration[5.1]
  def change
    create_table :users, &:timestamps
  end
end
