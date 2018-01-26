class CreateMessages < ActiveRecord::Migration[5.1]
  def change
    create_table :messages, &:timestamps
  end
end
